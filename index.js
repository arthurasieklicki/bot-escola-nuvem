const { Client, LocalAuth } = require('whatsapp-web.js');
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
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Essencial para rodar na nuvem gratuita do Render
    }
});

client.on('qr', (qr) => {
    console.log('====================================================');
    console.log('📱 ATENÇÃO: O Render bagunça o desenho no terminal.');
    console.log('🔗 CLIQUE NO LINK ABAIXO PARA VER O QR CODE PERFEITO:');
    
    // Transforma o código em um link de imagem gerada na hora
    const linkQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr);
    
    console.log('👉 ' + linkQrCode);
    console.log('====================================================');
});

client.on('ready', () => {
    console.log('🚀 TUDO PRONTO! O Bot do Arthur está conectado ao WhatsApp!');
});

client.on('message', message => {
    // Isso vai fazer o robô dedurar na tela preta tudo o que ele ouvir
    console.log('🗣️ Mensagem recebida: ' + message.body);

    // Agora ele responde se a palavra 'oi' estiver em qualquer lugar da frase
    if (message.body.toLowerCase().includes('oi')) {
        message.reply('Olá! Eu sou o Bot Acadêmico da turma do Arthur, rodando 100% na nuvem! ☁️🤖');
    }
});

client.initialize();
