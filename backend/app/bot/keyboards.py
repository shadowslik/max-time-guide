from aiomax import buttons

from backend.app.config import *


def how_use_bot():
    return [[buttons.CallbackButton("Как пользоваться ботом?", "how_use_bot")]]

def open_app():
    return [[buttons.WebAppButton("Собрать маршрут", BOT_USERNAME)]]


def get_location():
    return [[buttons.GeolocationButton("Поделиться геопозицией", quick=True)]]

def open_route():
    return [
        [buttons.LinkButton("Собрать маршрут", "https://168.113.157.47.sslip.io")],
    ]
