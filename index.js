const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

// 1. O SISTEMA ANTI-SONO (Mantém o servidor acordado)
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Bot do Arthur está acordado e operando na nuvem!');
});

app.listen(port, () => {
    console.log(`📡 Radar anti-sono ativado na porta ${port}`);
});

// 2. O CÉREBRO DO ROBÔ
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Essencial para rodar na nuvem gratuita
    }
});

client.on('qr', (qr) => {
    console.log('📱 ATENÇÃO: Escaneie o QR Code abaixo com o WhatsApp do Bot:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🚀 TUDO PRONTO! O Bot está conectado ao WhatsApp!');
});

client.on('message', message => {
    if (message.body.toLowerCase() === 'oi') {
        message.reply('Olá! Eu sou o Bot Acadêmico da turma, rodando 100% na nuvem! ☁️🤖');
    }
});

client.initialize();
