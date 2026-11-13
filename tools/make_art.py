"""The site's living art, taken from the games' own finished pieces (never drawn here).

    ..\\AVENGIS_REBOUNDED\\.venv\\Scripts\\python.exe tools\\make_art.py

Writes art/:
- logo_avengis.png, logo_games.png, logo_about.png: the AVENGIS mark (and About's title) in gold bricks (Rebounded's render/logo.py, as the game builds it)
- build_<logo>.png + build.json: the gold mark's letters (setting + bricks) for js/build.js to lay in
- head_<name>.png: the section headings in the same gold bricks (THE BRICKWORK's headings)
- logo_rebounded.png: REBOUNDED in the five worlds' bricks (the menu's size)
- dugout_title.png: THE DUGOUT and DOWN THE OLD MINE in The Dugout's own fonts, its title sign's colours
- scenes/<name>.png + scenes.json: Pocket's parallax backdrops (Aseprite atlases), each layer's drift, follow, fps, wrap
  and day and dusk frames, as the game's Backdrop reads them (scripts/view/backdrop.gd), for js/scene.js to draw
- water_<world>.png: a world's flood surface (8 frames of 256 x 11) and body, for the scenes' water line; Tideglass's
  surface frames stacked too (water_tideglass_stack.png) for the footer's flood
- crew_<hero>.png: the five heroes' animated crew portraits (96 frames of 50 x 50 at 12 fps)
- cave.png: The Dugout's cave back wall
- share.png: the link card (1200 x 630); icon.png, icon64.png, icon180.png: the tab and home-screen icons (the gold A)
- bars/ + bars.json: the seams, a sector level's two-row bar in a world's bricks (animated) and The Dugout's rail
- keys/: Pocket's small keycap, gold and slate, up (its first frame) and pressed, its two lamps, its chevron (down)
"""

import json
import os
import shutil
import sys
from pathlib import Path

os.environ.setdefault('SDL_VIDEODRIVER', 'dummy')
os.environ.setdefault('PYGAME_HIDE_SUPPORT_PROMPT', '1')

from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parents[1]
DEV = HERE.parent
POCKET = DEV / 'AVENGIS_FLOOD' / 'assets' / 'rebounded'
DUGOUT = DEV / 'AVENGIS_DUGOUT' / 'assets'
OUT = HERE / 'art'
SCENES = ('coppercloud-harbour', 'stormglass-peaks', 'tideglass-above', 'coppercloud-lighthouse', 'stormglass-above')
WATERS = ('tideglass', 'coppercloud')
HEROES = ('juno', 'rook', 'rowan', 'mira', 'nell')
NO_FLASH = {'lightning'}  # (never on the site: a bolt appearing and vanishing is a flash; Aven's epilepsy, no flashes)


def logos():
    sys.path.insert(0, str(DEV / 'AVENGIS_REBOUNDED'))
    import pygame
    pygame.init()
    pygame.display.set_mode((1, 1))
    from rebounded.render import logo
    sheet = pygame.image.load(str(POCKET / 'pieces' / 'logo-bricks.png')).convert_alpha()  # (kit.frame('logo-bricks-020'))
    for name, word, size, gold in (('logo_avengis', 'AVENGIS', 'big', True), ('logo_games', 'GAMES', 'small', True),
                                   ('logo_about', 'ABOUT', 'big', True), ('logo_lost', 'LOST?', 'big', True),
                                   ('head_games', 'THE GAMES', 'small', True), ('head_follow', 'FOLLOW ALONG', 'small', True),
                                   ('logo_rebounded', 'REBOUNDED', 'small', False)):
        pygame.image.save(logo.build(word, size, sheet, gold=gold), str(OUT / f'{name}.png'))
    build = {}
    for name, word, size in (('avengis', 'AVENGIS', 'big'), ('games', 'GAMES', 'small'), ('about', 'ABOUT', 'big'),
                             ('lost', 'LOST?', 'big')):
        # (js/build.js lays these in as the game's splash does: each letter's setting, and its bricks to fall in)
        letters = logo.parts(word, size, sheet, gold=True)
        sw, sh = letters[0][1].get_size()
        single = logo.brick_image(sheet, size, 5, False)
        double = logo.brick_image(sheet, size, 5, True)
        atlas = pygame.Surface((sw * len(letters) + single.get_width() + double.get_width(), max(sh, single.get_height())), pygame.SRCALPHA)
        for i, (_, setting, _) in enumerate(letters):
            atlas.blit(setting, (i * sw, 0))
        atlas.blit(single, (sw * len(letters), 0))
        atlas.blit(double, (sw * len(letters) + single.get_width(), 0))
        pygame.image.save(atlas, str(OUT / f'build_{name}.png'))
        w, h = logo.dimensions(word, size)
        build[name] = {
            'image': f'art/build_{name}.png', 'w': w, 'h': h, 'setting': [sw, sh],
            'single': [sw * len(letters), single.get_width(), single.get_height()],
            'double': [sw * len(letters) + single.get_width(), double.get_width(), double.get_height()],
            'letters': [{'x': sx, 'bricks': [[bx, by, int(im.get_width() == double.get_width())] for bx, by, im in bricks]}
                        for sx, _, bricks in letters],
        }
    (OUT / 'build.json').write_text(json.dumps(build, separators=(',', ':')), encoding='utf-8')


def bmfont(path):
    """A BMFont text file: {char: (x, y, w, h, xoffset, yoffset, xadvance)}, its page image, its line height."""
    chars, page, line = {}, None, 0
    for row in path.read_text(encoding='utf-8').splitlines():
        kind, *fields = row.split()
        f = dict(p.split('=', 1) for p in fields if '=' in p)
        if kind == 'common':
            line = int(f['lineHeight'])
        elif kind == 'page':
            page = Image.open(path.parent / f['file'].strip('"')).convert('RGBA')
        elif kind == 'char':
            chars[int(f['id'])] = tuple(int(f[k]) for k in ('x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance'))
    return chars, page, line


def say(text, font, colour=None):
    chars, page, line = bmfont(DUGOUT / 'fonts' / f'{font}.fnt')
    width = sum(chars[ord(c)][6] for c in text)
    out = Image.new('RGBA', (width, line))
    x = 0
    for c in text:
        cx, cy, w, h, ox, oy, adv = chars[ord(c)]
        if w and h:
            glyph = page.crop((cx, cy, cx + w, cy + h))
            if colour:
                tint = Image.new('RGBA', glyph.size, colour + (255,))
                tint.putalpha(glyph.split()[3])
                glyph = tint
            out.alpha_composite(glyph, (x + ox, oy))
        x += adv
    return out.crop(out.getbbox())


def dugout_title():
    """The title sign's words (menus.gd _title_page): THE DUGOUT warm in its 16, DOWN THE OLD MINE amber in its 8."""
    big = say('THE DUGOUT', 'font16', (226, 196, 150))
    small = say('DOWN THE OLD MINE', 'font8', (238, 186, 96))
    w = max(big.width, small.width) + 2
    out = Image.new('RGBA', (w, big.height + 8 + small.height + 1))
    shadow = Image.new('RGBA', out.size)
    for im, y in ((big, 0), (small, big.height + 8)):
        at = ((w - 2 - im.width) // 2, y)
        sh = Image.new('RGBA', im.size, (20, 12, 10, 255))
        sh.putalpha(im.split()[3])
        shadow.alpha_composite(sh, (at[0] + 1, at[1] + 1))
        out.alpha_composite(im, at)
    shadow.alpha_composite(out)
    shadow.save(OUT / 'dugout_title.png')


def pocket_say(text, size, gold=True):
    """Words in Pocket's own pixel font as art.gd draws a label: the glyphs packed edge to edge in one strip (the
    manifest's 'fonts'), the gap added only as they're laid; gold from the font's own gold strip, never a tint;
    outlined in the game's ink (left, right, up, down, and a pixel down-right)."""
    spec = json.loads((POCKET / 'manifest.json').read_text(encoding='utf-8'))['fonts'][str(size)]
    sheet = Image.open(POCKET / (spec['gold'] if gold else spec['file'])).convert('RGBA')
    widths, gap, h = spec['widths'], int(spec['gap']), int(spec['height'])
    starts, at = [], 0
    for w in widths:
        starts.append(at)
        at += w
    width = sum(widths[spec['chars'].index(c)] for c in text) + gap * (len(text) - 1)
    face = Image.new('RGBA', (width, h))
    x = 0
    for c in text:
        k = spec['chars'].index(c)
        face.alpha_composite(sheet.crop((starts[k], 0, starts[k] + widths[k], h)), (x, 0))
        x += widths[k] + gap
    ink = Image.new('RGBA', face.size, (5, 10, 18, 255))
    ink.putalpha(face.split()[3])
    out = Image.new('RGBA', (width + 3, h + 3))
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)):
        out.alpha_composite(ink, (1 + dx, 1 + dy))
    out.alpha_composite(face, (1, 1))
    return out.crop(out.getbbox())


def tagline():
    """BRICK BY BRICK under the mark, in Pocket's gold 16 with its ink."""
    pocket_say('BRICK BY BRICK', 16).save(OUT / 'tagline.png')
    pocket_say('ONE PERSON: ME, AVEN', 16).save(OUT / 'tagline_about.png')
    pocket_say('NOTHING HERE BUT SKY', 16).save(OUT / 'tagline_lost.png')  # (404.html's)


def scenes():
    """Each backdrop's atlas, and its layers back to front as backdrop.gd builds them (the day frames only)."""
    (OUT / 'scenes').mkdir(exist_ok=True)
    book = {}
    for name in SCENES:
        data = json.loads((POCKET / 'backdrops' / f'{name}.json').read_text(encoding='utf-8'))
        tags = {t['name']: (t['from'], t['to']) for t in data['meta'].get('frameTags', [])}
        day = tags.get('day', (0, 0))
        dusk = tags.get('dusk', day)  # (the evening and night frames: js/scene.js follows the visitor's clock)
        listed = data['frames'] if isinstance(data['frames'], list) else list(data['frames'].values())
        frames = {}
        for f in listed:
            layer, index = f['filename'].split('|')
            r, at = f['frame'], f.get('spriteSourceSize', {'x': 0, 'y': 0})
            frames.setdefault(layer, {})[int(index)] = [r['x'], r['y'], r['w'], r['h'], at['x'], at['y'], f['sourceSize']['w']]
        layers = []
        for layer in data['meta']['layers']:
            if layer['name'] in NO_FLASH:
                continue
            fields = dict(p.split('=') for p in str(layer.get('data', '')).split(';') if '=' in p)
            fps = float(fields.get('fps', 0))
            mine = frames[layer['name']]
            width = next(iter(mine.values()))[6]
            runs = [[mine[i][:6] for i in (range(tag[0], tag[1] + 1) if fps else [tag[0]])] for tag in (day, dusk)]
            wrap = int(fields.get('wrap', 0)) or width
            layers.append([float(fields.get('drift', 0)), float(fields.get('follow', 0)), fps, wrap, *runs])
        shutil.copyfile(POCKET / 'backdrops' / f'{name}.png', OUT / 'scenes' / f'{name}.png')
        book[name] = {'image': f'art/scenes/{name}.png', 'height': listed[0]['sourceSize']['h'], 'layers': layers}
    (OUT / 'scenes.json').write_text(json.dumps(book, separators=(',', ':')), encoding='utf-8')


def waters():
    manifest = json.loads((POCKET / 'manifest.json').read_text(encoding='utf-8'))
    for world in WATERS:
        flood = manifest['worlds'][world]['flood']
        shutil.copyfile(POCKET / flood['surface']['file'], OUT / f'water_{world}_surface.png')
        shutil.copyfile(POCKET / flood['body']['file'], OUT / f'water_{world}_body.png')
    # (the footer's flood, js/flood.js: Tideglass's surface frames stacked, one under the next, so the page can tile
    #  one frame along and step down through them)
    strip = Image.open(OUT / 'water_tideglass_surface.png').convert('RGBA')
    fw, fh = 256, strip.height
    stack = Image.new('RGBA', (fw, fh * (strip.width // fw)))
    for i in range(strip.width // fw):
        stack.paste(strip.crop((i * fw, 0, (i + 1) * fw, fh)), (0, i * fh))
    stack.save(OUT / 'water_tideglass_stack.png')


def crew():
    for hero in HEROES:
        shutil.copyfile(POCKET / 'heroes' / hero / 'crew.png', OUT / f'crew_{hero}.png')


def cave():
    """The Dugout's back wall: the old mine's brown earth, column 6 (128 wide) of assets/cavern/backs.png (each wall
    is a fine grid, made to sit behind the rock: the page keeps it faint, under a lantern's light)."""
    backs = Image.open(DUGOUT / 'cavern' / 'backs.png').convert('RGBA')
    tile = Image.new('RGBA', (128, 512), (7, 6, 10, 255))
    tile.alpha_composite(backs.crop((6 * 128, 0, 7 * 128, 512)))
    tile.convert('RGB').save(OUT / 'cave.png')


def keys():
    """Pocket's small keycap (assets/ui, tools/make_ui.py's KEYS: 70 x 21, ten shimmer frames; the page keeps the
    first, playing its sweep itself), gold and slate, up and pressed, and the switch lamps for the status labels."""
    (OUT / 'keys').mkdir(exist_ok=True)
    ui = POCKET.parent / 'ui'
    for tone in ('gold', 'slate'):
        for state in ('', '_down'):
            Image.open(ui / f'key_small_{tone}{state}.png').crop((0, 0, 70, 21)).save(OUT / 'keys' / f'{tone}{state}.png')
    for lamp in ('lamp_on', 'lamp_off'):
        shutil.copyfile(ui / f'{lamp}.png', OUT / 'keys' / f'{lamp}.png')
    # (its way on, turned a quarter to point down: lively.gd chevron_down, the header's way to the games)
    Image.open(ui / 'chevron.png').convert('RGBA').rotate(-90, expand=True).save(OUT / 'keys' / 'chevron_down.png')


def share_and_icon():
    """The link card (art/share.png, 1200 x 630: what Discord, Instagram and the rest show for a link) and the tab
    icons: the header as one still, Coppercloud's harbour by day with its water, AVENGIS GAMES and BRICK BY BRICK, at
    three times size; the mark's gold A (its small size) for the icon."""
    import pygame
    from rebounded.render import logo
    W, H = 400, 210
    book = json.loads((OUT / 'scenes.json').read_text(encoding='utf-8'))['coppercloud-harbour']
    atlas = Image.open(OUT / 'scenes' / 'coppercloud-harbour.png').convert('RGBA')
    surface = Image.open(OUT / 'water_coppercloud_surface.png').convert('RGBA').crop((0, 0, 256, 11))
    body = Image.open(OUT / 'water_coppercloud_body.png').convert('RGBA')
    P = 600  # (drawn on a wider sheet, margins all round, then cut to the card: nothing to clip by hand)
    sheet_ = Image.new('RGBA', (W + P * 2, H + P), (0, 0, 0, 255))
    sea = H - 11 - 3
    base = sea - book['height'] + 6
    x0 = (W - 384) // 2
    sky = book['layers'][0][4][0]
    strip = atlas.crop((sky[0], sky[1], sky[0] + sky[2], sky[1] + 1)).resize((sky[2], P + base + sky[5]))
    for sx in range(x0 + sky[4] - sky[2] * 6, W + sky[2], sky[2]):
        sheet_.alpha_composite(strip, (P + sx, 0))
    for drift, follow, fps, wrap, day, dusk in book['layers']:
        fx, fy, fw, fh, ox, oy = day[0]
        piece = atlas.crop((fx, fy, fx + fw, fy + fh))
        for start in range(-wrap * (P // wrap + 1), W + wrap, wrap):
            if -P <= x0 + start + ox and x0 + start + ox + fw <= W + P:
                sheet_.alpha_composite(piece, (P + x0 + start + ox, P + base + oy))
    for bx in range(0, W, body.width):
        sheet_.alpha_composite(body.crop((0, 0, body.width, H - sea - 5)), (P + bx, P + sea + 5))
    for wx in range(0, W, 256):
        sheet_.alpha_composite(surface, (P + wx, P + sea))
    card = sheet_.crop((P, P, P + W, P + H))
    words = [Image.open(OUT / 'logo_avengis.png').convert('RGBA'), Image.open(OUT / 'logo_games.png').convert('RGBA'),
             Image.open(OUT / 'tagline.png').convert('RGBA')]
    gaps = [4, 8]
    y = (H - 14 - sum(w.height for w in words) - sum(gaps)) // 2
    for i, w in enumerate(words):
        card.alpha_composite(w, ((W - w.width) // 2, y))
        y += w.height + (gaps[i] if i < len(gaps) else 0)
    card.convert('RGB').resize((W * 3, H * 3), Image.NEAREST).save(OUT / 'share.png', optimize=True)
    sheet = pygame.image.load(str(POCKET / 'pieces' / 'logo-bricks.png')).convert_alpha()
    a = logo.build('A', 'small', sheet, gold=True)
    pygame.image.save(a, str(OUT / '_a.png'))
    letter = Image.open(OUT / '_a.png').convert('RGBA')
    (OUT / '_a.png').unlink()
    icon = Image.new('RGBA', (32, 32))
    icon.alpha_composite(letter, ((32 - letter.width) // 2, (32 - letter.height) // 2))
    icon.save(OUT / 'icon.png')
    icon.resize((64, 64), Image.NEAREST).save(OUT / 'icon64.png')
    touch = Image.new('RGBA', (180, 180), (29, 25, 36, 255))  # (a phone's home screen: on the page's own dark)
    big = letter.resize((letter.width * 5, letter.height * 5), Image.NEAREST)
    touch.alpha_composite(big, ((180 - big.width) // 2, (180 - big.height) // 2))
    touch.convert('RGB').save(OUT / 'icon180.png')


BARS = ('coppercloud', 'stormglass', 'tideglass')


def bars():
    """The seams between the page's worlds: a sector level's bar between its two screens (Rebounded's
    worlds/second_screen.py BAR_TOP / BAR_LOW: two rows, a checkerboard of the world's tough brick and its cargo, '3'
    and '6'), each brick's own 24 frames (Pocket's pieces: tough1, motif2, motif5), for js/bricks.js; and one still
    (bar_<world>.png, 32 bricks along) for a page without it. And The Dugout's board rail (img/ui_board.png's top and
    bottom edges, an iron cap at each end of every 256) for the mine's top and foot."""
    manifest = json.loads((POCKET / 'manifest.json').read_text(encoding='utf-8'))
    (OUT / 'bars').mkdir(exist_ok=True)
    book = {}
    for world in BARS:
        pieces = manifest['worlds'][world]['pieces']
        keys = ('tough1', 'motif2', 'motif5')  # ('S', '3', '6': play_view.gd's keys for them)
        frames = pieces['tough1']['frames']
        atlas = Image.new('RGBA', (16 * frames, 8 * len(keys)))
        for row, key in enumerate(keys):
            strip = Image.open(POCKET / pieces[key]['file']).convert('RGBA')
            atlas.paste(strip.crop((0, 0, 16 * frames, 8)), (0, row * 8))
        atlas.save(OUT / 'bars' / f'{world}.png')
        still = Image.new('RGBA', (16 * 32, 16))
        for r in range(2):
            for c in range(32):
                ch = ('S' if c % 2 == 0 else '36'[c // 2 % 2]) if r == 0 else ('S' if c % 2 == 1 else '63'[c // 2 % 2])
                k = 'S36'.index(ch)
                still.alpha_composite(atlas.crop((0, k * 8, 16, k * 8 + 8)), (c * 16, r * 8))
        still.save(OUT / 'bars' / f'bar_{world}.png')
        book[world] = {'image': f'art/bars/{world}.png', 'frames': frames, 'ms': pieces['tough1']['ends'][0]}
    (OUT / 'bars.json').write_text(json.dumps(book, separators=(',', ':')), encoding='utf-8')
    board = Image.open(HERE / 'img' / 'ui_board.png').convert('RGBA')  # (36 x 36: 10 px edges, iron corners)
    for name, y in (('rail_top', 0), ('rail_foot', 26)):
        rail = Image.new('RGBA', (256, 10))
        edge = board.crop((10, y, 26, y + 10))
        for x in range(0, 256, 16):
            rail.alpha_composite(edge, (x, 0))
        rail.alpha_composite(board.crop((0, y, 10, y + 10)), (0, 0))      # (an iron cap: the board's corner)
        rail.alpha_composite(board.crop((26, y, 36, y + 10)), (246, 0))
        rail.save(OUT / 'bars' / f'{name}.png')


def main():
    OUT.mkdir(exist_ok=True)
    logos()
    dugout_title()
    tagline()
    scenes()
    waters()
    crew()
    cave()
    keys()
    bars()
    share_and_icon()
    print('art written to', OUT)


if __name__ == '__main__':
    main()
