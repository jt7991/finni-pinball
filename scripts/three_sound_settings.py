# SPDX-License-Identifier: GPL-3.0-or-later
"""Read PinSound's serialized mixer settings without executing the table."""
import hashlib
import struct
import olefile

def sound_settings(data, offset):
    if len(data)-offset != 17:
        raise ValueError('Expected the current PinSound settings footer')
    target, legacy_volume, pan, fade, volume = struct.unpack_from('<Biiii', data, offset)
    return {'outputTarget': 'backglass' if target == 1 else 'playfield',
            'volumePercent': volume, 'panPercent': pan, 'frontRearFadePercent': fade}

def table_sound_sources(path):
    """Yield named source bytes and mixer settings from the serialized table."""
    names_seen = set()
    with olefile.OleFileIO(path) as table:
        version, = struct.unpack('<I', table.openstream(['GameStg', 'Version']).read())
        if version != 1080:
            raise ValueError('Verify the sound serialization before importing another table version')
        for stream in table.listdir():
            if len(stream) != 2 or stream[0] != 'GameStg' or not stream[1].startswith('Sound'):
                continue
            data = table.openstream(stream).read()
            offset, names = 0, []
            for _ in range(3):
                size, = struct.unpack_from('<I', data, offset)
                offset += 4
                names.append(data[offset:offset+size].decode('utf-8').rstrip('\0'))
                offset += size
            wave_format = None
            if names[1].lower().endswith('.wav'):
                wave_format = data[offset:offset+18]
                if len(wave_format) != 18 or struct.unpack_from('<H', wave_format, 16)[0] != 0:
                    raise ValueError('Extended WAV format needs explicit decoding')
                offset += 18
            size, = struct.unpack_from('<I', data, offset)
            offset += 4
            payload = data[offset:offset+size]
            if len(payload) != size:
                raise ValueError('Truncated sound data')
            if wave_format:
                payload = (b'RIFF'+struct.pack('<I', 4+8+18+8+size)+b'WAVEfmt '+
                           struct.pack('<I', 18)+wave_format+b'data'+struct.pack('<I', size)+payload)
            name = names[0].lower()
            if name in names_seen:
                raise ValueError('Duplicate sound '+name)
            names_seen.add(name)
            yield name, payload, sound_settings(data, offset+size)

def table_sound_settings(path):
    return {name: {'sourceSHA256': hashlib.sha256(payload).hexdigest(), **settings}
            for name, payload, settings in table_sound_sources(path)}
