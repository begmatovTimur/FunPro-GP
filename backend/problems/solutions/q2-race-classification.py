n, m = map(int, input().split())
cars = []
for i in range(n):
    parts = input().split()
    cars.append((sum(map(int, parts[1:])), i, parts[0]))
cars.sort()
lead = cars[0][0]
for pos, (t, _, code) in enumerate(cars, 1):
    if pos == 1:
        h, rem = divmod(t, 3600000)
        mnt, rem = divmod(rem, 60000)
        s, ms = divmod(rem, 1000)
        print(f"1 {code} {h}:{mnt:02d}:{s:02d}.{ms:03d}")
    else:
        g = t - lead
        print(f"{pos} {code} +{g // 1000}.{g % 1000:03d}")
