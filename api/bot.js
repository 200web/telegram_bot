import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { questions } from '../data/questions.js'; // Импортируем вопросы
dotenv.config();

// Получение пути к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    
    // Определяем путь к видеофайлу относительно текущей директории
    const videoPath = path.resolve(__dirname, '../media/video.mp4');

    // Проверяем, существует ли файл по указанному пути
    if (!fs.existsSync(videoPath)) {
      throw new Error(`File not found: ${videoPath}`);
    }

    // Send the video from the local file system
    await ctx.telegram.sendVideo(chatId, { source: fs.createReadStream(videoPath) }, {
        caption: 'Here is your video!',
        supports_streaming: true
    });

    // Через 5 секунд отправить сообщение с кнопкой
    setTimeout(async () => {
      await ctx.telegram.sendMessage(chatId, "Let's start the quiz!", Markup.inlineKeyboard([
        Markup.button.callback('ПЕРЕЙТИ К ТЕСТУ', 'start_quiz')
      ]));
    }, 5000);

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

// Функция для отправки видеокружочка
async function sendVideoNoteExplanation(chatId, videoFileName) {
  const videoPath = path.resolve(__dirname, `../media/${videoFileName}`);

  // Проверяем, существует ли файл по указанному пути
  if (!fs.existsSync(videoPath)) {
    console.error(`Video file not found: ${videoPath}`);
    return;
  }

  // Отправка видеокружочка
  await bot.telegram.sendVideoNote(chatId, { source: fs.createReadStream(videoPath) });
}

// Обработчик нажатия на кнопку
bot.action('start_quiz', (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  askQuestion(chatId, userId);
});

// Обработчик ответа на опрос
bot.on('poll_answer', async (ctx) => {
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

    // Отправка видеокружочка после правильного ответа
    await sendVideoNoteExplanation(ctx.chat.id, `explanation_${questionIndex + 1}.mp4`);

    if (session.currentQuestionIndex < questions.length) {
      setTimeout(() => {
        askQuestion(userId, userId);
      }, 5000); // 5 секунд задержка перед следующим вопросом
    } else {
      bot.telegram.sendMessage(userId, 'Congratulations, you have completed the quiz!');
      delete userSessions[userId];
    }
  } else {
    // Неправильный ответ
    bot.telegram.sendMessage(userId, 'Wrong answer. Try again.');

    // Отправка видеокружочка после неправильного ответа
    await sendVideoNoteExplanation(ctx.chat.id, `explanation_${questionIndex + 1}.mp4`);

    setTimeout(() => {
      askQuestion(userId, userId);
    }, 5000); // 5 секунд задержка перед повторным вопросом
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