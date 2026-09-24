import aiomax

from .keyboards import *


class BotApp:
    def __init__(self, token: str):
        self.bot = aiomax.Bot(
            access_token=token,
            use_certificate=True,
        )
        self._register_handlers()

    def _register_handlers(self):
        bot = self.bot

        @bot.on_bot_start()
        async def on_start(ctx):
            name = getattr(ctx.user, "first_name", None) or "путешественник"
            await ctx.send(
                f"Привет, {name}!\n\n"
                "Я помогу собрать маршрут по городу под твоё время.\n\n"
                "Нажми кнопку ниже, чтобы узнать, как это работает.",
                keyboard=how_use_bot(),
            )

        @bot.on_button_callback("how_use_bot")
        async def on_help(ctx):
            await ctx.send(
                "ℹ️ Как пользоваться:\n\n"
                "1. Нажми «Собрать маршрут» — откроется приложение.\n"
                "2. Разреши доступ к геолокации и укажи время и интересы.\n"
                "3. Получишь готовый маршрут по лучшим местам.\n\n"
                "Открой приложение, чтобы начать",
                keyboard=open_route(),
            )

    def run(self):
        self.bot.run()
