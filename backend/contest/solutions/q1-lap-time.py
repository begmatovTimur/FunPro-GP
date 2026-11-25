ms = int(input())
minutes = ms // 60000
seconds = ms // 1000 % 60
millis = ms % 1000
print(f"{minutes}:{seconds:02d}.{millis:03d}")
