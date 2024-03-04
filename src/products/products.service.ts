import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/pagination.dto';
import { DataSource, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
// import { Product } from './entities/product.entity';
import { validate as isUUID } from "uuid";
import { ProductImage, Product } from './entities';
import { User } from 'src/auth/entities/user.entity';
@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService')

  constructor(
    @InjectRepository(Product)
    private readonly productRespository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRespository: Repository<ProductImage>,

    private readonly dataSource: DataSource,
  ) {}
  
  async create(createProductDto: CreateProductDto, user: User) {
    try {
      const { images = [], ...productDatails } = createProductDto;
      // entity product codigo de nombrar el slug = title
      const product = this.productRespository.create({
        ...productDatails,
        images: images.map( image => this.productImageRespository.create({ url: image }) ),
        user,
      });
      await this.productRespository.save( product );
      // return prodcut
      return { ...product, images };
      
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  // TODO: paginar
  async findAll( paginationDto: PaginationDto ) {
    const { limit = 10, offset = 0 } = paginationDto
    // return await this.productRespository.find({
    const products = await this.productRespository.find({
      take: limit,
      skip: offset,
      // TODO: relaciones
      relations: {
        images: true,
      }
    });
    // map sirve para transformar un arreglo en otra cosa
    return products.map( product => ({
      ...product,
      images: product.images.map( img => img.url)
    }))
  }

  async findOne(term: string) {
    let product: Product;

    if ( isUUID(term) ) {
      product = await this.productRespository.findOneBy({ id: term });
    } else {
      // product = await this.productRespository.findOneBy({ slug: term });
      const queryBuilder = this.productRespository.createQueryBuilder('prod');
      product = await queryBuilder
        .where('UPPER(title) =:title or slug =:slug', {
          title: term.toUpperCase(),
          slug: term.toLowerCase(),
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne()
        // `Select * from Products where slug ='XX' or title='xxxx`
    }

    // const product = await this.productRespository.findOneBy({ id });

    if ( !product ) 
      throw new NotFoundException(`Product with id ${ term } not found`);
    return product;
  }
  
  async findOnePlain(term: string) {
    const { images = [], ...rest } = await this.findOne( term );
    return {
      ...rest,
      images: images.map( image => image.url )
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto, user: User) {

    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRespository.preload({
      id,
      ...toUpdate,
      // images: [],
    });

    if ( !product ) throw new NotFoundException(`Product with id: ${ id } not found`);
    
    // create query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {

      if ( images ) {
        await queryRunner.manager.delete( ProductImage, { product: { id } } ) //cuidado de delete * from ProductImage
        
        product.images = images.map( 
          image => this.productImageRespository.create({ url: image }) 
        )
      } // else {
      //   product.images = await this.productImageRespository.findBy({ product: { id } });
      // }
      product.user = user;

      await queryRunner.manager.save( product );
      await queryRunner.commitTransaction();
      await queryRunner.release();
      // await this.productRespository.save( product );

      // return product; // con el else {}
      return this.findOnePlain( id ); // sin el else {}

    } catch (error) {

      await queryRunner.rollbackTransaction();
      await queryRunner.release();

      this.handleDBExceptions(error);
    }

  }

  async remove(id: string) {
    const product = await this.findOne( id );
    await this.productRespository.remove( product );
  }

  private handleDBExceptions( error: any ) {
    if ( error.code === '23505')
      throw new BadRequestException(error.detail);
    this.logger.error(error)
    throw new InternalServerErrorException('Unexpected error, check server logs');
  }

  async deleteAllProducts() {
    const query = this.productRespository.createQueryBuilder('product');

    try {
      return await query
        .delete()
        .where({})
        .execute();
    } catch (error) {
      this.handleDBExceptions(error)
    }
  }

}
