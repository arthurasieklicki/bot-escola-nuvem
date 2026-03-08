const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const { google } = require('googleapis');

// === CONFIGURAÇÃO DO GOOGLE (Coloque o ID da Planilha Convertida!) ===
const SPREADSHEET_ID = '194u0HgyLbBTkOVL1hrILXarjv0AugCxRtgm6jN9YIG8'; 

const auth = new google.auth.GoogleAuth({
    keyFile: './credenciais.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

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
            if (telefoneZap.includes(telLimpo.slice(-8))) {
                return { matricula: linhas[i][0], nome: linhas[i][1] };
            }
        }
        return null;
    } catch (erro) { return null; }
}

async function anotarPresenca(matricula) {
    try {
        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const idEntrega = 'PR-' + Date.now().toString().slice(-5);
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Entregas!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[idEntrega, dataHora, matricula, 'Frequência/Presença', '-', 'Registrada ✅']] }
        });
        return true;
    } catch (erro) { return false; }
}

// === SISTEMA ANTI-SONO ===
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 Bot conectado e travado na nuvem!'));
app.listen(port, () => console.log(`📡 Radar ativado na porta ${port}`));

// === MOTOR DO WHATSAPP (Com trava de memória e auto-reconectar tipo PM2) ===
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Isso obriga o servidor gratuito a não estourar a memória
            '--disable-extensions'
        ]
    }
});

client.on('qr', qr => {
    console.log('\n====================================================');
    console.log('🔗 CLIQUE NO LINK ABAIXO PARA O QR CODE (Igual antes!):');
    console.log('👉 https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qr));
    console.log('====================================================\n');
});

client.on('ready', () => {
    console.log('🚀 TUDO PRONTO E TRAVADO! O Bot conectou ao WhatsApp e ao Google!');
});

// A TRAVA ESTILO PM2: Se cair, ele levanta na mesma hora
client.on('disconnected', (reason) => {
    console.log('🔌 Conexão sofreu queda:', reason);
    console.log('🔄 O guardião interno está reiniciando o motor...');
    client.initialize(); 
});

client.on('message', async msg => {
    if(msg.fromMe) return;
    const texto = msg.body.toLowerCase().trim();
    const numeroRemetente = msg.from.replace('@c.us', '');
    
    if (texto === 'oi' || texto === 'olá') {
        const aluno = await buscarAluno(numeroRemetente);
        if (aluno) {
            await msg.reply(`Fala, *${aluno.nome}*! 😎 Eu sou o Bot Acadêmico!\n\nSua matrícula é a *${aluno.matricula}*. Digite *PRESENTE* para eu registrar a sua frequência.`);
        } else {
            await msg.reply('Olá! Eu sou o Bot Acadêmico! 🤖\nNão encontrei este número cadastrado. Fale com a equipe!');
        }
    }
    else if (texto === 'presente') {
        const aluno = await buscarAluno(numeroRemetente);
        if (aluno) {
            await msg.reply('⏳ Conectando aos servidores do Google...');
            const sucesso = await anotarPresenca(aluno.matricula);
            if (sucesso) {
                await msg.reply(`✅ Boa, *${aluno.nome}*! Presença salva na aba Entregas! +10 XP pra você! 🎮`);
            } else {
                await msg.reply('❌ Ops! Deu erro ao salvar no Google.');
            }
        }
    }
});

client.initialize();
