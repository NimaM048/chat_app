import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';

import { ApiResponse as ApiResponseShape } from '../../../shared/interfaces/api-response.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const uploadRoot = join(process.cwd(), 'uploads');

if (!existsSync(uploadRoot)) {
  mkdirSync(uploadRoot, { recursive: true });
}

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  @Post()
  @ApiOperation({ summary: 'Upload image, file, or voice blob' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadRoot),
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname) || '';
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File): ApiResponseShape<{
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return {
      success: true,
      data: {
        url: `/uploads/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    };
  }
}
