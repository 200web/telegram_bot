import { Telegraf } from 'telegraf';
import { questions } from '../data/questions'; // Импорт вопросов

const bot = new Telegraf(process.env.BOT_TOKEN);

const userSessions = {};

bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = { currentQuestionIndex: 0 };
  ctx.reply('Привет! Начинаем опрос. Ответь на вопросы!');
  askQuestion(ctx);
});

function askQuestion(ctx) {
  const userId = ctx.from.id;
  const session = userSessions[userId];
  const questionData = questions[session.currentQuestionIndex];

  const options = questionData.options.map((option, index) => `${index + 1}. ${option}`).join('\n');
  
  ctx.reply(`${questionData.question}\n${options}`);
}

bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];
  const questionData = questions[session.currentQuestionIndex];
  const userAnswer = ctx.message.text.trim();

  if (userAnswer === questionData.correctAnswer) {
    ctx.reply('Правильный ответ! Переходим к следующему вопросу.');
    session.currentQuestionIndex += 1;

    if (session.currentQuestionIndex < questions.length) {
      askQuestion(ctx);
    } else {
      ctx.reply('Поздравляю, ты прошел опрос!');
      delete userSessions[userId];
    }
  } else {
    ctx.reply('Неверный ответ. Попробуй снова.');
    askQuestion(ctx);
  }
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling update:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
