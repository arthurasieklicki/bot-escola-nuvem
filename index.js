const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const { google } = require('googleapis');

// ============================================================================
// ⚙️ CONFIGURAÇÕES DA PLANILHA DO GOOGLE
// ============================================================================
const SPREADSHEET_ID = '194u0HgyLbBTkOVL1hrILXarjv0AugCxRtgm6jN9YIG8'; // <-- COLOQUE SEU ID AQUI

const auth = new google.auth.GoogleAuth({
    keyFile: './credenciais.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// 🧠 FUNÇÃO 1: Lê a aba 'Alunos' e descobre quem está mandando mensagem
async function buscarAluno(telefoneZap) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Alunos!A:C' // Lê Matrícula, Nome e Telefone
        });
        const linhas = response.data.values;
        if (!linhas) return null;

        // Pula o cabeçalho (linha 0) e procura o telefone
        for (let i = 1; i < linhas.length; i++) {
            let telPlanilha = linhas[i][2]; // Coluna C (Telefone)
            if (!telPlanilha) continue;

            // Limpa o número e pega só os últimos 8 dígitos (Evita bug do 9º dígito)
            let telLimpo = String(telPlanilha).replace(/\D/g, '');
            let ultimos8 = telLimpo.slice(-8);

            if (telefoneZap.includes(ultimos8)) {
                return {
                    matricula: linhas[i][0], // Coluna A
                    nome: linhas[i][1]       // Coluna B
                };
            }
        }
        return null; // Não encontrou o aluno
    } catch (erro) {
        console.error('❌ Erro ao buscar aluno:', erro.message);
        return null;
    }
}

// ✍️ FUNÇÃO 2: Salva a presença na aba 'Entregas'
async function anotarPresenca(matricula) {
    try {
        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const idEntrega = 'PR-' + Date.now().toString().slice(-5); // Gera um ID automático

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Entregas!A:F', // Preenche das colunas A até F
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                // A: ID_Entrega, B: Data_Hora, C: Matricula, D: Materia, E: Link, F: Status
                values: [[idEntrega, dataHora, matricula, 'Frequência/Presença', '-', 'Registrada ✅']]
            }
        });
        console.log(`📝 Sucesso! Presença da matrícula ${matricula} salva na aba Entregas!`);
        return true;
    } catch (erro) {
        console.error('❌ Erro ao escrever na planilha:', erro.message);
        return false;
    }
}

// ============================================================================
// SISTEMA ANTI-SONO E MOTOR DO ROBÔ
// ============================================================================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('🤖 Bot conectado ao Google Sheets!'));
app.listen(port, () => console.log(`📡 Radar ativado na porta ${port}`));

async function connectToWhatsApp () {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' }),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        retryRequestDelayMs: 250
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            console.log('🔗 CLIQUE NO LINK ABAIXO PARA LER O QR CODE:');
            console.log('👉 https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr));
        }

        if(connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log('🔌 Conexão caiu. Código:', code);
            
            if(shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000); 
            } else {
                fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if(connection === 'open') {
            console.log('🚀 TUDO PRONTO! O Bot está voando na nuvem e lendo a sua planilha!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if(!msg.key.fromMe && m.type === 'notify') {
            const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const numeroRemetente = msg.key.remoteJid.replace('@s.whatsapp.net', '');
            
            if (texto) {
                console.log(`🗣️ Mensagem recebida: ${texto}`);
                const textoLimpo = texto.toLowerCase().trim();

                // Comando: OI
                if (textoLimpo === 'oi' || textoLimpo === 'olá') {
                    // Vai na planilha descobrir quem é
                    const aluno = await buscarAluno(numeroRemetente);
                    
                    if (aluno) {
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: `Fala, *${aluno.nome}*! 😎 Eu sou o Bot Acadêmico da turma!\n\nSua matrícula é a *${aluno.matricula}*. Digite a palavra *PRESENTE* para eu registrar a sua frequência de hoje lá no sistema.` 
                        });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: 'Olá! Eu sou o Bot Acadêmico! 🤖\n\nHmmm... Eu procurei na aba de Alunos, mas não encontrei este número de telefone cadastrado. Fale com o Arthur para ele te adicionar!' 
                        });
                    }
                }
                
                // Comando: PRESENTE
                else if (textoLimpo === 'presente') {
                    const aluno = await buscarAluno(numeroRemetente);
                    
                    if (aluno) {
                        await sock.sendMessage(msg.key.remoteJid, { text: '⏳ Conectando aos servidores do Google...' });
                        
                        const sucesso = await anotarPresenca(aluno.matricula);
                        
                        if (sucesso) {
                            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Boa, *${aluno.nome}*! Sua presença foi registrada com sucesso na aba de Entregas! +10 XP pra você! 🎮` });
                        } else {
                            await sock.sendMessage(msg.key.remoteJid, { text: '❌ Ops! Deu um erro ao tentar salvar no Google. Avise o administrador!' });
                        }
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { text: 'Você precisa estar cadastrado na aba de Alunos para registrar presença!' });
                    }
                }
            }
        }
    });
}

connectToWhatsApp();
