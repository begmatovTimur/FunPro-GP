POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
positions = list(map(int, input().split()))
total = 0
for p in positions:
    if 1 <= p <= 10:
        total += POINTS[p - 1]
print(total)
