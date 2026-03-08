const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const { google } = require('googleapis');

// ============================================================================
// ⚙️ CONFIGURAÇÕES DA PLANILHA DO GOOGLE (Preencha aqui!)
// ============================================================================
const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_SUA_PLANILHA'; // <-- SUBSTITUA ISSO PELO SEU ID
const NOME_DA_ABA = 'Página1'; // Nome da aba lá embaixo na planilha (geralmente Página1)

// Autenticação com o crachá do Google (O arquivo secreto que você salvou no Render)
const auth = new google.auth.GoogleAuth({
    keyFile: './credenciais.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// Função que o robô usa para escrever na planilha
async function anotarPresencaNaPlanilha(numeroAluno) {
    try {
        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${NOME_DA_ABA}!A:C`, // Vai escrever nas colunas A, B e C
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[numeroAluno, 'PRESENTE', dataHora]]
            }
        });
        console.log(`📝 Sucesso! Presença do número ${numeroAluno} salva na planilha do Google!`);
    } catch (erro) {
        console.error('❌ Erro ao tentar escrever na planilha:', erro.message);
    }
}

// ============================================================================
// 1. O SISTEMA ANTI-SONO
// ============================================================================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Bot da escola está acordado, conectado ao Google e operando na nuvem!');
});

app.listen(port, () => {
    console.log(`📡 Radar anti-sono ativado na porta ${port}`);
});

// ============================================================================
// 2. O CÉREBRO DO ROBÔ BLINDADO
// ============================================================================
async function connectToWhatsApp () {
    console.log('🔄 Iniciando os motores e preparando a conexão...');
    
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'), // Máscara da Apple contra bloqueios
        logger: pino({ level: 'silent' }),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        retryRequestDelayMs: 250
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            console.log('====================================================');
            console.log('📱 ATENÇÃO: MOTOR MAC OS ATIVADO COM SUCESSO!');
            console.log('🔗 CLIQUE NO LINK ABAIXO PARA LER O QR CODE:');
            const linkQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr);
            console.log('👉 ' + linkQrCode);
            console.log('====================================================');
        }

        if(connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            
            console.log('🔌 Conexão caiu. Código do erro:', code || 'Desconhecido');
            
            if(shouldReconnect) {
                console.log('♻️ Tentando reconectar em 5 segundos...');
                setTimeout(connectToWhatsApp, 5000); 
            } else {
                console.log('🚨 Sessão inválida. O robô está limpando os dados corrompidos...');
                fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if(connection === 'open') {
            console.log('🚀 TUDO PRONTO! O Bot está voando na nuvem e conectado ao Google!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if(!msg.key.fromMe && m.type === 'notify') {
            const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const numeroRemetente = msg.key.remoteJid.replace('@s.whatsapp.net', '');
            
            if (texto) {
                console.log(`🗣️ Mensagem de ${numeroRemetente}: ${texto}`);
                const textoLimpo = texto.toLowerCase().trim();

                // Regra 1: Se o aluno disser "Oi"
                if (textoLimpo === 'oi' || textoLimpo === 'olá') {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        text: 'Olá! Eu sou o Bot do Arthur para a Feira de Ciências! 🤖☁️\n\nDigite a palavra *PRESENTE* para eu registrar o seu acesso lá no nosso banco de dados do Google!' 
                    });
                }
                
                // Regra 2: Se o aluno disser "Presente"
                else if (textoLimpo === 'presente') {
                    await sock.sendMessage(msg.key.remoteJid, { text: '⏳ Aguarde um instante, estou acessando os servidores do Google...' });
                    
                    // Aciona a função que escreve na planilha
                    await anotarPresencaNaPlanilha(numeroRemetente);
                    
                    await sock.sendMessage(msg.key.remoteJid, { text: '✅ Sua presença foi registrada com sucesso na nuvem do Google!' });
                }
            }
        }
    });
}

connectToWhatsApp();
