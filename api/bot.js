import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const bot = new Telegraf("7705319594:AAHAiDjUyBiWRaT4R1FZecfSJBatGfNuNe4");

const userSessions = {};
console.log('Проверка...');

bot.command('start', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    userSessions[userId] = { currentQuestionIndex: 0 };
    console.log('Команда /start получена');
    
    // Send a greeting message
    await ctx.reply('Hello! My name is Teo!');

    // Send the video as a document from Google Cloud Storage
    const videoPath = './media/video.mp4'; // Path to your video file
    await ctx.telegram.sendVideo(chatId, { source: fs.createReadStream(videoPath) });

    ctx.reply('Welcome! Let\'s start the quiz.');

    // Проверяем, что вопросы есть
    if (questions.length > 0) {
      setTimeout(() => {
        console.log('Отправляем первый вопрос');
        askQuestion(chatId, userId);
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
function askQuestion(chatId, userId) {
  const session = userSessions[userId];

  if (!session) {
    bot.telegram.sendMessage(chatId, 'Session not found. Please start the quiz again with /start.');
    return;
  }

  const questionIndex = session.currentQuestionIndex;
  const questionData = questions[questionIndex];

  if (!questionData) {
    bot.telegram.sendMessage(chatId, 'No more questions available.');
    return;
  }

  console.log(`Sending question ${questionIndex + 1}: ${questionData.question}`);

  // Убедитесь, что options — это массив строк
  if (!Array.isArray(questionData.options) || questionData.options.length === 0) {
    console.error('Invalid options for question:', questionData);
    bot.telegram.sendMessage(chatId, 'Failed to send the question. Please check the configuration.');
    return;
  }

  bot.telegram.sendPoll(
    chatId,
    questionData.question,
    questionData.options,
    { is_anonymous: false }
  ).catch((error) => {
    console.error('Error sending poll:', error);
    bot.telegram.sendMessage(chatId, 'Failed to send the question. Please try again later.');
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
    bot.telegram.sendMessage(userId, 'Correct answer! Moving to the next question.');
    session.currentQuestionIndex += 1;

    if (session.currentQuestionIndex < questions.length) {
      setTimeout(() => {
        askQuestion(userId, userId);
      }, 2000);
    } else {
      bot.telegram.sendMessage(userId, 'Congratulations, you have completed the quiz!');
      delete userSessions[userId];
    }
  } else {
    // Неправильный ответ
    bot.telegram.sendMessage(userId, 'Wrong answer. Try again.');
    setTimeout(() => {
      askQuestion(userId, userId);
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