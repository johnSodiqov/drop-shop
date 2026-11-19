import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { STORAGE_DIRECTORIES, StorageDirectory, StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('directory') directory: string = 'products',
  ) {
    return this.storage.upload(file, this.directory(directory));
  }

  @Post('upload/multiple')
  @UseInterceptors(FilesInterceptor('files', 20, { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 } }))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('directory') directory: string = 'products',
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    const dir = this.directory(directory);
    return {
      success: true,
      data: await Promise.all(files.map((file) => this.storage.upload(file, dir).then((result) => result.data))),
    };
  }

  @Delete(':directory/:filename')
  delete(@Param('directory') directory: string, @Param('filename') filename: string) {
    const dir = this.directory(directory);
    return this.storage.delete(`${dir}/${filename}`);
  }

  @Get('list')
  list(
    @Query('directory') directory?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (directory) this.directory(directory);
    return this.storage.list(directory, cursor, limit ? Number(limit) : 50);
  }

  private directory(value: string): StorageDirectory {
    if (!STORAGE_DIRECTORIES.includes(value as StorageDirectory)) {
      throw new BadRequestException('Invalid storage directory');
    }
    return value as StorageDirectory;
  }
}
