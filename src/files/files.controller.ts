import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFile, UseInterceptors, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { fileFilter } from './helpers/fileFilter.helper';
import { diskStorage } from "multer";
import { fileNamer } from './helpers/fileNamer.helper';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Files - Get and Upload')
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly confidService: ConfigService,
  ) {}

  @Get('product/:imageName')
  findProductImage(
    @Res() res: Response,
    @Param('imageName') imageName: string
  ) {

    const path = this.filesService.getStaticProductImage( imageName );

    // return path;
    // res.status(403).json({
    //   ok: false,
    //   path: path
    // })

    res.sendFile( path );

  }

  @Post('product')
  @UseInterceptors( FileInterceptor('file', {
    fileFilter: fileFilter,
    // limits: { fileSize: 1000 }
    storage: diskStorage({
      destination: './static/products',
      filename: fileNamer
    })
  }) )
  uploadProductImage( 
    @UploadedFile() file: Express.Multer.File, 
  ){

    // console.log({ fileInController: file });

    if ( !file ) {
      throw new BadRequestException('Make sure that the file is an image');
    }

    // console.log(file);

    // const secureUrl = `${ file.filename }`;
    // const secureUrl = `${ this. confidService.get('HOST_API') }/files/product/7d130ee3-a44c-4e24-9a9d-be68cbda8e0a.jpeg`;
    const secureUrl = `${ this. confidService.get('HOST_API') }/files/product/${ file.filename }`;

    return {
      // fileName: file.originalname
      secureUrl
    };
  }

}
