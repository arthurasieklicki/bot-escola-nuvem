const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

// 1. O SISTEMA ANTI-SONO (Mantém o servidor acordado)
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Bot da escola está acordado e operando na nuvem!');
});

app.listen(port, () => {
    console.log(`📡 Radar anti-sono ativado na porta ${port}`);
});

// 2. O NOVO CÉREBRO DO ROBÔ (Motor Baileys - Super Leve)
async function connectToWhatsApp () {
    // Salva a conexão para não pedir QR Code toda hora
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Vamos usar o nosso link customizado
        browser: ['Ubuntu', 'Chrome', '20.0.04'], // A MÁSCARA: Engana a segurança do WhatsApp
        logger: pino({ level: 'silent' }) // Desliga os avisos chatos do sistema
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            console.log('====================================================');
            console.log('📱 ATENÇÃO: NOVO MOTOR LEVE ATIVADO!');
            console.log('🔗 CLIQUE NO LINK ABAIXO PARA LER O QR CODE:');
            const linkQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr);
            console.log('👉 ' + linkQrCode);
            console.log('====================================================');
        }

        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            // Agora ele dedura o motivo exato da queda na tela preta
            console.log('🔌 Conexão caiu. Motivo:', lastDisconnect.error?.message || lastDisconnect.error);
            
            if(shouldReconnect) {
                console.log('♻️ Tentando reconectar...');
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('🚀 TUDO PRONTO! O Bot está voando na nuvem livre de travamentos!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        // Ignora mensagens enviadas por você mesmo ou de sistema
        if(!msg.key.fromMe && m.type === 'notify') {
            // Captura o texto seja de qual formato for
            const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            
            if (texto) {
                console.log('🗣️ Mensagem recebida: ' + texto);

                if (texto.toLowerCase().includes('oi')) {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'Olá! Eu sou o Bot Acadêmico da turma, rodando 100% na nuvem! ☁️🤖 E agora com motor turbo!' });
                }
            }
        }
    });
}

connectToWhatsApp();
