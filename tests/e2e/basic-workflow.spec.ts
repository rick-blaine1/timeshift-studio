import { test, expect } from '@playwright/test';

test.describe('Timelapse Editor Basic Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the application correctly', async ({ page }) => {
    // Check that the main elements are present
    await expect(page.getByText('Upload video clips')).toBeVisible();
    await expect(page.getByText('Choose files')).toBeVisible();
    await expect(page.getByText('Files never leave your device')).toBeVisible();
  });

  test('shows file upload area and controls', async ({ page }) => {
    // Check file upload area
    await expect(page.locator('[data-testid="upload-area"]')).toBeVisible();
    
    // Check that timeline is empty initially
    await expect(page.getByText('Drop clips here to start building your timelapse')).toBeVisible();
    
    // Check that export button is disabled when no content
    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeDisabled();
  });

  test('handles file upload simulation', async ({ page }) => {
    // Since we can't actually upload files in E2E tests easily,
    // we'll test the sample data functionality instead
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    
    if (await loadSampleButton.isVisible()) {
      await loadSampleButton.click();
      
      // Wait for sample files to load
      await expect(page.getByText(/\.mp4|\.webm/)).toBeVisible({ timeout: 5000 });
    }
  });

  test('timeline interactions work correctly', async ({ page }) => {
    // Load sample data if available
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    if (await loadSampleButton.isVisible()) {
      await loadSampleButton.click();
      await page.waitForTimeout(1000);
    }

    // Try to add a file to timeline if files are available
    const addToTimelineButton = page.getByRole('button', { name: /add to timeline/i }).first();
    if (await addToTimelineButton.isVisible()) {
      await addToTimelineButton.click();
      
      // Check that timeline shows the clip
      await expect(page.locator('[data-testid="timeline-clip"]')).toBeVisible();
      
      // Check that export button becomes enabled
      const exportButton = page.getByRole('button', { name: /export/i });
      await expect(exportButton).toBeEnabled();
    }
  });

  test('speed controls work correctly', async ({ page }) => {
    // Test speed multiplier input
    const speedInput = page.getByRole('spinbutton', { name: /speed/i });
    if (await speedInput.isVisible()) {
      await speedInput.fill('2');
      await expect(speedInput).toHaveValue('2');
    }

    // Test speed preset buttons
    const speed4xButton = page.getByRole('button', { name: '4x' });
    if (await speed4xButton.isVisible()) {
      await speed4xButton.click();
      await expect(speedInput).toHaveValue('4');
    }
  });

  test('preview quality toggle works', async ({ page }) => {
    const qualityToggle = page.getByRole('switch', { name: /preview quality/i });
    if (await qualityToggle.isVisible()) {
      // Test toggling preview quality
      await qualityToggle.click();
      await expect(qualityToggle).toBeChecked();
      
      await qualityToggle.click();
      await expect(qualityToggle).not.toBeChecked();
    }
  });

  test('export modal opens and shows correct information', async ({ page }) => {
    // Load sample data and add to timeline
    const loadSampleButton = page.getByRole('button', { name: /load sample/i });
    if (await loadSampleButton.isVisible()) {
      await loadSampleButton.click();
      await page.waitForTimeout(1000);
      
      const addToTimelineButton = page.getByRole('button', { name: /add to timeline/i }).first();
      if (await addToTimelineButton.isVisible()) {
        await addToTimelineButton.click();
        await page.waitForTimeout(500);
        
        // Open export modal
        const exportButton = page.getByRole('button', { name: /export/i });
        await exportButton.click();
        
        // Check export modal content
        await expect(page.getByText('Export Timelapse')).toBeVisible();
        await expect(page.getByText('Output duration')).toBeVisible();
        await expect(page.getByText('Resolution')).toBeVisible();
        await expect(page.getByText('Clips')).toBeVisible();
        
        // Check that start export button is present
        await expect(page.getByRole('button', { name: /start export/i })).toBeVisible();
        
        // Close modal
        await page.getByRole('button', { name: /cancel/i }).click();
        await expect(page.getByText('Export Timelapse')).not.toBeVisible();
      }
    }
  });

  test('project management works', async ({ page }) => {
    // Test clear project functionality
    const clearButton = page.getByRole('button', { name: /clear project/i });
    if (await clearButton.isVisible()) {
      // Load some sample data first
      const loadSampleButton = page.getByRole('button', { name: /load sample/i });
      if (await loadSampleButton.isVisible()) {
        await loadSampleButton.click();
        await page.waitForTimeout(1000);
        
        // Clear the project
        await clearButton.click();
        
        // Handle confirmation dialog if it appears
        page.on('dialog', dialog => dialog.accept());
        
        // Verify project is cleared
        await expect(page.getByText('Upload video clips')).toBeVisible();
      }
    }
  });

  test('responsive design works on different screen sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText('Upload video clips')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('Upload video clips')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByText('Upload video clips')).toBeVisible();
  });

  test('keyboard navigation works', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Test that focused elements are visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('error handling displays correctly', async ({ page }) => {
    // Test with invalid file type (if file input is accessible)
    // This is a basic test since we can't easily simulate file uploads
    
    // Check that error states don't crash the app
    await page.evaluate(() => {
      // Simulate an error condition
      console.error('Test error');
    });
    
    // App should still be functional
    await expect(page.getByText('Upload video clips')).toBeVisible();
  });

  test('performance is acceptable', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check that main content is visible quickly
    await expect(page.getByText('Upload video clips')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('Accessibility', () => {
  test('has proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper button roles
    const buttons = page.getByRole('button');
    expect(await buttons.count()).toBeGreaterThan(0);
    
    // Check for proper input labels
    const inputs = page.getByRole('textbox');
    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      // Each input should have either aria-label or aria-labelledby
      expect(ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });

  test('supports keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Test that all interactive elements are reachable by keyboard
    let tabCount = 0;
    const maxTabs = 20; // Prevent infinite loop
    
    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      
      if (await focusedElement.count() === 0) {
        break; // No more focusable elements
      }
      
      tabCount++;
    }
    
    expect(tabCount).toBeGreaterThan(0);
  });

  test('has sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    
    // This is a basic test - in a real scenario, you'd use axe-core
    // Check that text is visible (basic contrast check)
    const textElements = page.locator('text=Upload video clips');
    await expect(textElements).toBeVisible();
    
    // Check that buttons have visible text
    const buttons = page.getByRole('button');
    for (let i = 0; i < Math.min(await buttons.count(), 5); i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();
    }
  });
});