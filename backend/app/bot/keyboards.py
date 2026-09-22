from aiomax import buttons

from backend.app.config import *


def route_keyboard():
    return [[buttons.WebAppButton("Собрать маршрут", BOT_USERNAME),
             buttons.CallbackButton("Как пользоваться ботом?", "how_use_bot")]]


def how_use_bot():
    return [[buttons.WebAppButton("Собрать маршрут", BOT_USERNAME)]]
