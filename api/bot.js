console.log('Бот запускается...');

import { Telegraf } from 'telegraf';
import { questions } from '../data/questions.js';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf("7705319594:AAHAiDjUyBiWRaT4R1FZecfSJBatGfNuNe4");

const userSessions = {};
console.log('Проверка2...');

bot.start((ctx) => {
  try {
    const userId = ctx.from.id;
    userSessions[userId] = { currentQuestionIndex: 0 };
    console.log('Команда /start получена');
    ctx.reply('Welcome! Let\'s start the quiz.');

    // Проверяем, что вопросы есть
    if (questions.length > 0) {
      setTimeout(() => {
        console.log('Отправляем первый вопрос');
        askQuestion(ctx);
      }, 1000);
    } else {
      ctx.reply('No questions available. Please check the configuration.');
      console.error('Questions array is empty.');
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
  }
});

// Функция для отправки вопроса
function askQuestion(ctx) {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (!session) {
    ctx.reply('Session not found. Please start the quiz again with /start.');
    return;
  }

  const questionIndex = session.currentQuestionIndex;
  const questionData = questions[questionIndex];

  if (!questionData) {
    ctx.reply('No more questions available.');
    return;
  }

  console.log(`Sending question ${questionIndex + 1}: ${questionData.question}`);

  // Убедитесь, что options — это массив строк
  if (!Array.isArray(questionData.options) || questionData.options.length === 0) {
    console.error('Invalid options for question:', questionData);
    ctx.reply('Failed to send the question. Please check the configuration.');
    return;
  }

  bot.telegram.sendPoll(
    ctx.chat.id,
    questionData.question,
    questionData.options,
    { is_anonymous: false }
  ).catch((error) => {
    console.error('Error sending poll:', error);
    ctx.reply('Failed to send the question. Please try again later.');
  });
}

// Обработчик ответа на опрос
bot.on('poll_answer', (ctx) => {
  const userId = ctx.update.poll_answer.user.id;
  const session = userSessions[userId];

  if (!session) {
    console.error('Session not found for user:', userId);
    return;
  }

  const questionIndex = session.currentQuestionIndex;
  const questionData = questions[questionIndex];
  const userAnswer = ctx.update.poll_answer.option_ids[0];

  if (!questionData) {
    console.error('Question data not found for index:', questionIndex);
    return;
  }

  console.log(`User answered question ${questionIndex + 1}:`, questionData.options[userAnswer]);

  if (questionData.options[userAnswer] === questionData.correctAnswer) {
    // Правильный ответ
    ctx.reply('Correct answer! Moving to the next question.');
    session.currentQuestionIndex += 1;

    if (session.currentQuestionIndex < questions.length) {
      setTimeout(() => {
        askQuestion(ctx);
      }, 2000);
    } else {
      ctx.reply('Congratulations, you have completed the quiz!');
      delete userSessions[userId];
    }
  } else {
    // Неправильный ответ
    ctx.reply('Wrong answer. Try again.');
    setTimeout(() => {
      askQuestion(ctx);
    }, 2000);
  }
});

// Запуск бота
bot.launch().then(() => {
  console.log('Бот запущен и готов к работе!');
}).catch((error) => {
  console.error('Ошибка при запуске бота:', error);
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