n = int(input())
in_pits = {}
stops = {}
total = {}
for i in range(n):
    t, code, event = input().split()
    t = int(t)
    if event == "IN":
        if code in in_pits:
            print(f"error {t} {code} already in pits")
        else:
            in_pits[code] = t
    else:
        if code not in in_pits:
            print(f"error {t} {code} not in pits")
        else:
            duration = t - in_pits.pop(code)
            stops[code] = stops.get(code, 0) + 1
            total[code] = total.get(code, 0) + duration
for code in sorted(total, key=lambda c: (total[c], c)):
    print(code, stops[code], total[code])
for code in sorted(in_pits):
    print(code, "still in pits")
