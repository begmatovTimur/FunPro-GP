POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
n = int(input())
total = 0
for p in map(int, input().split()):
    if 1 <= p <= 10:
        total += POINTS[p - 1]
print(total)
