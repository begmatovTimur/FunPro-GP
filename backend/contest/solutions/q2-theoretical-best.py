def show(ms):
    return f"{ms // 60000}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"

n = int(input())
best_lap = None
best_lap_no = 0
best_s = [None, None, None]
for i in range(1, n + 1):
    s = list(map(int, input().split()))
    lap = s[0] + s[1] + s[2]
    if best_lap is None or lap < best_lap:
        best_lap = lap
        best_lap_no = i
    for j in range(3):
        if best_s[j] is None or s[j] < best_s[j]:
            best_s[j] = s[j]
ideal = best_s[0] + best_s[1] + best_s[2]
print(f"FASTEST LAP {best_lap_no} {show(best_lap)}")
print(f"THEORETICAL {show(ideal)}")
print(f"GAP {(best_lap - ideal) / 1000:.3f}")
