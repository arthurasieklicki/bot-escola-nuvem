const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const { google } = require('googleapis');

// ============================================================================
// ⚙️ CONFIGURAÇÕES DA PLANILHA E DO WHATSAPP
// ============================================================================
const SPREADSHEET_ID = 'COLE_AQUI_O_NOVO_ID_DA_PLANILHA_CONVERTIDA'; 
const NUMERO_DO_BOT = '5546999999999'; // <-- COLOQUE O NÚMERO DO BOT COM 55 E DDD

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
            range: 'Alunos!A:C'
        });
        const linhas = response.data.values;
        if (!linhas) return null;

        for (let i = 1; i < linhas.length; i++) {
            let telPlanilha = linhas[i][2]; 
            if (!telPlanilha) continue;
            let telLimpo = String(telPlanilha).replace(/\D/g, '');
            let ultimos8 = telLimpo.slice(-8);

            if (telefoneZap.includes(ultimos8)) {
                return { matricula: linhas[i][0], nome: linhas[i][1] };
            }
        }
        return null;
    } catch (erro) {
        console.error('❌ Erro ao buscar aluno:', erro.message);
        return null;
    }
}

// ✍️ FUNÇÃO 2: Salva a presença na aba 'Entregas'
async function anotarPresenca(matricula) {
    try {
        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const idEntrega = 'PR-' + Date.now().toString().slice(-5);

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Entregas!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
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
// SISTEMA ANTI-SONO E MOTOR DO ROBÔ COM PAREAMENTO SEGURO
// ============================================================================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('🤖 Bot conectado ao Google Sheets!'));
app.listen(port, () => console.log(`📡 Radar ativado na porta ${port}`));

let codigoSolicitado = false; // A TRAVA DE SEGURANÇA: Impede que o código fique expirando

async function connectToWhatsApp () {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger: pino({ level: 'silent' }),
        connectTimeoutMs: 60000,
    });

    // 🚀 O NOVO BYPASS: CÓDIGO DE PAREAMENTO ÚNICO
    if (!sock.authState.creds.registered && !codigoSolicitado) {
        codigoSolicitado = true; // Trava ativada: não vai pedir de novo sozinho
        
        console.log('⏳ Preparando para gerar o código. Deixe o celular no jeito...');
        
        setTimeout(async () => {
            try {
                const numeroLimpo = NUMERO_DO_BOT.replace(/[^0-9]/g, '');
                let code = await sock.requestPairingCode(numeroLimpo);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                
                console.log('\n====================================================');
                console.log('🚨 O SEU CÓDIGO DE PAREAMENTO ESTÁ PRONTO!');
                console.log(`🔑 DIGITE NO CELULAR AGORA: ${code}`);
                console.log('====================================================\n');
            } catch (err) {
                console.log('❌ Erro ao gerar código. Verifique se o número do bot está correto.');
                codigoSolicitado = false; // Destrava se der erro para tentar de novo
            }
        }, 5000); // Espera 5 segundos para a rede estabilizar
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if(connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log('🔌 Conexão caiu. Código:', code);
            
            if(shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000); 
            } else {
                fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                codigoSolicitado = false; // Destrava se precisar limpar a sessão
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

                if (textoLimpo === 'oi' || textoLimpo === 'olá') {
                    const aluno = await buscarAluno(numeroRemetente);
                    if (aluno) {
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: `Fala, *${aluno.nome}*! 😎 Eu sou o Bot Acadêmico da turma!\n\nSua matrícula é a *${aluno.matricula}*. Digite a palavra *PRESENTE* para eu registrar a sua frequência de hoje lá no sistema.` 
                        });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: 'Olá! Eu sou o Bot Acadêmico! 🤖\n\nHmmm... Eu procurei na aba de Alunos, mas não encontrei este número cadastrado. Fale com a equipe para te adicionar!' 
                        });
                    }
                }
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
                    }
                }
            }
        }
    });
}

connectToWhatsApp();
