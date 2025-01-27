import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
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

// Обработчик нажатия на кнопку
bot.action('start_quiz', (ctx) => {
  ctx.reply('Quiz started!');
  // Здесь можно добавить логику для начала викторины
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