first, slower, limit = map(int, input().split())
laps = 0
total = 0
lap_time = first
while lap_time <= limit:
    laps += 1
    total += lap_time
    lap_time += slower
print("LAPS", laps)
print(f"TIME {total // 60000}:{total // 1000 % 60:02d}.{total % 1000:03d}")
