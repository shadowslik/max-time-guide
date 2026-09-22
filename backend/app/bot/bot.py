import aiomax

from backend.app.bot.keyboards import *


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
                f"Привет, {name}! 👋\n\n"
                "Я помогу спланировать прогулку по городу под то время, что у тебя есть.\n"
                "Скажи, где ты и сколько у тебя часов — и я соберу маршрут из лучших мест, "
                "которые реально успеть посмотреть, не опоздав назад.\n\n"
                "Нажми «Собрать маршрут», чтобы начать",
                keyboard=route_keyboard(),
            )

        @bot.on_button_callback("how_use_bot")
        async def on_help(ctx):
            await ctx.message.delete()
            await ctx.send(
                "ℹ️ Как пользоваться ботом:\n\n"
                "1. Нажми «Собрать маршрут» — откроется мини-приложение.\n"
                "2. Укажи город, точку старта (вокзал, отель) и сколько у тебя времени.\n"
                "3. Отметь, что тебе интересно: история, еда, прогулки, музеи.\n"
                "4. Получишь готовый маршрут: места по порядку, сколько времени на каждое, "
                "путь между ними и запас, чтобы успеть вернуться.\n\n"
                "Команды:\n"
                "• /route — собрать новый маршрут\n\n"
                "💡 Чем точнее укажешь время и точку старта, тем удобнее будет маршрут.",
                keyboard=how_use_bot(),
            )

        @bot.on_command("route")
        async def on_route(ctx):
            await ctx.reply("Погнали 👇", keyboard=route_keyboard())

    def run(self):
        self.bot.run()

