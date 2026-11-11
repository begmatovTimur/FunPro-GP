POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
r = int(input())
pts, finishes = {}, {}
for _ in range(r):
    for pos, code in enumerate(input().split()):
        pts[code] = pts.get(code, 0) + POINTS[pos]
        finishes.setdefault(code, [0] * 10)[pos] += 1
order = sorted(pts, key=lambda c: (-pts[c], [-x for x in finishes[c]], c))
for c in order:
    print(c, pts[c])
