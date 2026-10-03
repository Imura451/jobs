# シェア用の画像（assets/ogp.png・1200×630）を作ります。
#   python tools/make-ogp.py
# 文言を変えたいときは、下の TEXT を直してもう一度実行してください。
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RED, INK, MUTED, GRAY = (227, 6, 19), (26, 26, 26), (97, 97, 97), (245, 245, 245)
FONT = r'C:\Windows\Fonts\NotoSansJP-VF.ttf'

def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f

im = Image.new('RGB', (1200, 630), 'white')
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 1200, 14), fill=RED)
logo = Image.open(os.path.join(ROOT, 'assets', 'logo.png')).convert('RGBA')
logo.thumbnail((96, 102))
im.paste(logo, (80, 60), logo)
d.text((196, 111), 'ガイコクジンコネクト', font=font(34, 700), fill=INK, anchor='lm')
d.text((80, 250), '日本で働きたい外国人の', font=font(64, 700), fill=INK, anchor='ls')
d.text((80, 340), '仕事さがし', font=font(84, 700), fill=RED, anchor='ls')
d.text((80, 420), '日本に住んでいて転職したい方も、海外からこれから来る方も', font=font(30, 400), fill=INK, anchor='ls')
d.text((80, 468), '社長インタビュー動画つき。相談も紹介も無料です', font=font(30, 400), fill=INK, anchor='ls')
d.rectangle((0, 548, 1200, 630), fill=GRAY)
d.text((80, 590), 'Jobs in Japan for foreign workers ｜ やさしい日本語 / English', font=font(26, 400), fill=MUTED, anchor='lm')
im.save(os.path.join(ROOT, 'assets', 'ogp.png'))
print('assets/ogp.png を作りました')
