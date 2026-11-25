POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
r = int(input())
points = {}
wins = {}
for race in range(r):
    order = input().split()
    for pos, code in enumerate(order):
        if code not in points:
            points[code] = 0
            wins[code] = 0
        if pos < 10:
            points[code] += POINTS[pos]
        if pos == 0:
            wins[code] += 1
table = sorted(points, key=lambda c: (-points[c], -wins[c], c))
for place, code in enumerate(table, 1):
    print(place, code, points[code])
