import re

with open('frontend/src/routes/doctor/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Main container
content = content.replace('p-8 max-w-5xl mx-auto font-sans bg-base min-h-screen', 'px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen')

# 2. Shadows
content = re.sub(r'shadow-\[0_8px_30px_rgb[^\]]+\]', 'shadow-md', content)
content = re.sub(r'shadow-\[0_12px_40px_rgb[^\]]+\]', 'shadow-lg', content)
content = re.sub(r'shadow-\[0_4px_20px_rgb[^\]]+\]', 'shadow-sm', content)

# 3. Standardize radii
content = content.replace('rounded-3xl', 'rounded-2xl')

with open('frontend/src/routes/doctor/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Doctor Portal replaced classes successfully.')
