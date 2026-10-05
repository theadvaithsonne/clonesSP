# Cabinet System - File Storage & Management

A Google Drive-like file storage system integrated into the Roam application, powered by Amazon S3 for cloud storage.

## Features

### Backend Features

- **Cabinet Management**: Create, read, update, delete folders (cabinets)
- **File Operations**: Upload, download, delete files
- **AWS S3 Integration**: Secure cloud storage with presigned URLs
- **User Isolation**: Each user has their own file storage space
- **Organization Support**: Files are organized by organization
- **Search Functionality**: Search across files and folders
- **File Metadata**: Track file size, type, upload date, etc.

### Frontend Features

- **Modern UI**: Clean, intuitive interface similar to Google Drive
- **Drag & Drop**: Easy file uploads
- **Folder Navigation**: Breadcrumb navigation with folder hierarchy
- **File Preview**: File type icons and metadata display
- **Search**: Real-time search across files and folders
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

### Backend Components

1. **Models** (`src/models/`)

   - `cabinet.model.ts`: Cabinet/folder data structure
   - `file.model.ts`: File metadata and S3 references

2. **Services** (`src/services/`)

   - `s3.ts`: AWS S3 integration service

3. **Controllers** (`src/controllers/`)

   - `cabinet.controller.ts`: API endpoint handlers

4. **Routes** (`src/routes/`)
   - `cabinet.ts`: REST API routes for cabinet operations

### Frontend Components

1. **Pages** (`app/(dashboard)/workspace/cabinet/`)

   - `page.tsx`: Main cabinet page route

2. **Components** (`components/dashboard/`)
   - `CabinetPage.tsx`: Main cabinet interface component

## API Endpoints

### Cabinet Operations

- `POST /cabinet` - Create new cabinet/folder
- `GET /cabinet` - List cabinets for user
- `GET /cabinet/:id` - Get cabinet contents
- `PUT /cabinet/:id` - Update cabinet
- `DELETE /cabinet/:id` - Delete cabinet

### File Operations

- `POST /cabinet/files/upload` - Upload file
- `GET /cabinet/files/:id/download` - Get download URL
- `GET /cabinet/files/:id/info` - Get file metadata
- `DELETE /cabinet/files/:id` - Delete file

### Search

- `GET /cabinet/search` - Search files and cabinets

## Setup Instructions

### 1. Backend Setup

1. **Install Dependencies**

   ```bash
   cd roam-backend
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner uuid
   ```

2. **Environment Variables**
   Add these to your `.env` file:

   ```env
   AWS_S3_REGION=your-aws-region
   AWS_S3_BUCKET=your-s3-bucket-name
   AWS_ACCESS_KEY_ID=your-aws-access-key-id
   AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
   AWS_S3_ENDPOINT=https://your-s3-endpoint.com
   AWS_S3_FORCE_PATH_STYLE=false
   ```

3. **AWS S3 Bucket Setup**
   - Create an S3 bucket
   - Configure appropriate permissions
   - Set up CORS if needed for direct uploads

### 2. Frontend Setup

The cabinet system is automatically integrated into the dashboard. Users can access it through:

1. **Marketplace**: Cabinet app is listed in the marketplace
2. **Direct Navigation**: Navigate to `/cabinet` route
3. **App Integration**: Cabinet appears in the apps section

## Usage

### For Users

1. **Access Cabinet**: Go to the marketplace and subscribe to the Cabinet app, or navigate directly to `/cabinet`

2. **Create Folders**: Click "New Folder" to create organized storage

3. **Upload Files**: Click "Upload" and select files (up to 100MB)

4. **Navigate**: Use breadcrumbs to navigate between folders

5. **Search**: Use the search bar to find files and folders

6. **Download**: Click the download button on any file

### For Developers

The cabinet system is designed to be extensible:

- **Custom File Types**: Add support for specific file types
- **Permissions**: Implement folder/file sharing
- **Versioning**: Add file version control
- **Collaboration**: Enable multi-user editing

## Security Features

- **User Isolation**: Each user's files are completely isolated
- **Presigned URLs**: Secure file access without exposing S3 credentials
- **Authentication**: All endpoints require valid JWT tokens
- **File Validation**: File type and size validation
- **Path Sanitization**: Prevents directory traversal attacks

## File Structure

```
cabinet/
├── organizationId/
│   └── userId/
│       ├── timestamp_randomId_filename.ext
│       └── ...
```

## Limitations

- **File Size**: 100MB maximum per file
- **Storage**: Limited by AWS S3 bucket capacity
- **Concurrent Uploads**: No built-in chunked upload support
- **File Versions**: No versioning system (can be added)

## Future Enhancements

- [ ] File sharing between users
- [ ] Real-time collaboration
- [ ] File versioning
- [ ] Advanced search with filters
- [ ] File preview for images/documents
- [ ] Bulk operations (move, copy, delete)
- [ ] File encryption at rest
- [ ] Usage analytics and quotas

## Troubleshooting

### Common Issues

1. **Upload Fails**: Check AWS credentials and bucket permissions
2. **Download Fails**: Verify S3 bucket CORS configuration
3. **Search Not Working**: Ensure MongoDB indexes are created
4. **File Not Found**: Check if file exists in S3 and database

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your environment variables.

## Contributing

When adding new features to the cabinet system:

1. Update the appropriate model if needed
2. Add new API endpoints in the controller
3. Update the frontend component
4. Add proper error handling
5. Update this documentation

## Support

For issues or questions about the cabinet system, please check:

1. AWS S3 documentation
2. MongoDB documentation
3. Next.js documentation for frontend issues
