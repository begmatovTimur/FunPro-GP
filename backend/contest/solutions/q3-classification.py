def race_time(ms):
    h, rest = divmod(ms, 3600000)
    m, rest = divmod(rest, 60000)
    s, millis = divmod(rest, 1000)
    return f"{h}:{m:02d}:{s:02d}.{millis:03d}"

n = int(input())
finished = []
retired = []
for i in range(n):
    parts = input().split()
    code = parts[0]
    if parts[1] == "DNF":
        retired.append(code)
    else:
        laps = list(map(int, parts[1:]))
        finished.append((sum(laps), i, code))
finished.sort()
for place, (total, i, code) in enumerate(finished, 1):
    if place == 1:
        print(1, code, race_time(total))
    else:
        print(place, code, f"+{(total - finished[0][0]) / 1000:.3f}")
for code in retired:
    print("DNF", code)
