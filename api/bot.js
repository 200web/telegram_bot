import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf("7705319594:AAHAiDjUyBiWRaT4R1FZecfSJBatGfNuNe4");

const userSessions = {};

bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = { sessionId: userId }; // Простой способ создания сессии
  ctx.reply('Привет! Добро пожаловать в нашего бота.');
});

bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (session) {
    ctx.reply(`Ваш номер сессии: ${session.sessionId}`);
  } else {
    ctx.reply('Сессия не найдена. Пожалуйста, начните с команды /start.');
  }
});

bot.launch();

// Экспорт обработчика для Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log('Получен POST-запрос от Telegram');
    try {
      console.log('Тело запроса:', req.body);
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling update:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    console.log('Получен неверный метод запроса:', req.method);
    res.status(405).send('Method Not Allowed');
  }
}