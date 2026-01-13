# 🏷️ Label Creator - CRUD Web Application

A simple, elegant label creator built with vanilla JavaScript that demonstrates full CRUD (Create, Read, Update, Delete) functionality with local storage persistence.

## Features

### ✨ Full CRUD Operations
- **Create**: Add new labels with custom text, color, and size
- **Read**: View all created labels in a responsive grid layout
- **Update**: Edit existing labels by clicking the edit button
- **Delete**: Remove labels with confirmation dialog

### 🎨 Customization Options
- **Text**: Up to 50 characters
- **Color**: Choose any color using the color picker
- **Size**: Three size options (Small, Medium, Large)

### 💾 Data Persistence
- All labels are saved to browser's local storage
- Labels persist between browser sessions
- No backend or database required

### ✅ Form Validation
- Required field validation
- Minimum character length check
- Real-time error messages

## How to Use

1. **Open the Application**
   - Simply open `index.html` in your web browser
   - No server or build process required

2. **Create a Label**
   - Fill in the label text (required, 2-50 characters)
   - Choose a color using the color picker
   - Select a size (Small, Medium, or Large)
   - Click "Create Label"

3. **Edit a Label**
   - Click the "✏️ Edit" button on any label
   - Modify the fields in the form
   - Click "Update Label" to save changes
   - Click "Cancel" to discard changes

4. **Delete a Label**
   - Click the "🗑️ Delete" button on any label
   - Confirm the deletion in the dialog

## File Structure

```
custom-label-creator/
├── index.html      # Main HTML structure
├── styles.css      # All styling and responsive design
├── app.js          # JavaScript CRUD logic and local storage
└── README.md       # This file
```

## Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with Grid, Flexbox, and animations
- **Vanilla JavaScript**: ES6+ features, no frameworks
- **Local Storage API**: Data persistence

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Any modern browser with ES6 support

## Code Highlights

### Object-Oriented Design
The app uses a `LabelManager` class that encapsulates all CRUD operations and UI logic.

### Security
- HTML escaping to prevent XSS attacks
- Input validation and sanitization

### User Experience
- Smooth animations and transitions
- Responsive design for mobile and desktop
- Confirmation dialogs for destructive actions
- Visual feedback for all interactions

## Future Enhancements

Possible improvements you could add:
- Export labels to JSON/CSV
- Import labels from file
- Search and filter functionality
- Drag-and-drop reordering
- Categories or tags
- Print labels feature

## License

Free to use and modify for any purpose.

