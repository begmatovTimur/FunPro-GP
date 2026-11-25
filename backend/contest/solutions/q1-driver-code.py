words = input().split()
number = int(input())
code = words[-1][:3].upper()
print(f"{code} #{number}")
