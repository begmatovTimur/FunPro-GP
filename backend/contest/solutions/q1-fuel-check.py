laps = int(input())
per_lap = float(input())
loaded = float(input())
needed = laps * per_lap
if loaded >= needed + 1:
    print(f"OK {loaded - needed:.2f}")
elif loaded >= needed:
    print(f"RISKY {loaded - needed:.2f}")
else:
    print(f"BOX {needed - loaded:.2f}")
