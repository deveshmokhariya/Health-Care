import re

with open('frontend/src/routes/patient/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Main container
content = content.replace('p-8 max-w-5xl mx-auto font-sans bg-base min-h-screen', 'px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen')

# 2. Shadows
content = re.sub(r'shadow-\[0_20px_60px_rgb[^\]]+\]', 'shadow-xl', content)
content = re.sub(r'shadow-\[0_8px_40px_rgb[^\]]+\]', 'shadow-lg', content)
content = re.sub(r'shadow-\[0_8px_30px_rgb[^\]]+\]', 'shadow-md', content)
content = re.sub(r'shadow-\[0_12px_40px_rgb[^\]]+\]', 'shadow-lg', content)
content = re.sub(r'shadow-\[0_4px_20px_rgb[^\]]+\]', 'shadow-sm', content)

# 3. Form Spacing
content = content.replace('mb-3', 'mb-2') # Label bottom margin
content = content.replace('space-y-1.5', 'space-y-2')

# 4. Standardize radii
content = content.replace('rounded-3xl', 'rounded-2xl')

with open('frontend/src/routes/patient/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Replaced classes successfully.')
