n = int(input())
gaps = list(map(int, input().split())) if n > 1 else []
print(sum(1 for g in gaps if g <= 1000))
