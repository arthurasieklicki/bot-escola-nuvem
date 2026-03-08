const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
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
    // A CHAVE MESTRA: Busca a versão oficial mais recente do WhatsApp Web na internet
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🌐 Usando WhatsApp Web versão: ${version.join('.')}`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        version, // Passa a versão oficial para o servidor aceitar a conexão
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177'], // Máscara moderna
        logger: pino({ level: 'silent' }),
        connectTimeoutMs: 60000, // Dá 1 minuto de tolerância para a internet do servidor
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            console.log('====================================================');
            console.log('📱 ATENÇÃO: MOTOR LEVE E ATUALIZADO ATIVADO!');
            console.log('🔗 CLIQUE NO LINK ABAIXO PARA LER O QR CODE:');
            const linkQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr);
            console.log('👉 ' + linkQrCode);
            console.log('====================================================');
        }

        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Conexão caiu. Motivo:', lastDisconnect.error?.message || 'Falha de rede');
            
            if(shouldReconnect) {
                console.log('♻️ Respirando... Tentando reconectar em 5 segundos...');
                // Aguarda 5 segundos antes de tentar de novo para não ser bloqueado pelo WhatsApp
                setTimeout(connectToWhatsApp, 5000); 
            }
        } else if(connection === 'open') {
            console.log('🚀 TUDO PRONTO! O Bot está voando na nuvem livre de travamentos!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if(!msg.key.fromMe && m.type === 'notify') {
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
