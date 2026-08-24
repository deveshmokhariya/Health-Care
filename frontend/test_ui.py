import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto('http://localhost:5173/login')
        await page.fill('input[type="email"]', 'shlok@gmail.com')
        await page.fill('input[type="password"]', 'password')
        await page.click('button[type="submit"]')
        await page.wait_for_url('**/patient*')
        
        await page.click('text=My Appointments')
        await page.wait_for_timeout(2000)
        
        text = await page.locator('body').inner_text()
        print(text)
        
        await browser.close()

asyncio.run(run())
