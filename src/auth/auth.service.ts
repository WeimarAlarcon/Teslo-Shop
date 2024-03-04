import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from "bcrypt";
import { LoginUserDto } from './dto/login-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,

  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10)
      });

      await this.userRepository.save(user)

      delete user.password
      //Todo: Retorno el JWT de acceso

      return {
        ...user,
        // token: this.getJwtToken({ email: user.email} ),
        token: this.getJwtToken({ id: user.id} ),
      };

    } catch (error) {
      // console.log(error);
      this.handleDBErrors(error)
    }
  }

  async login(loginUserDto: LoginUserDto) {
    // try {
      
    // } catch (error) {
    //   this.handleDBErrors(error)
    // }
    const { email, password } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true  }
    })

    if (!user) {
      throw new UnauthorizedException('Credenciales are not valid (email)');
    }

    if ( !bcrypt.compareSync( password, user.password ) ) {
      throw new UnauthorizedException('Credenciales are not valid (password)');
    }
    
    return {
      ...user,
      token: this.getJwtToken({ id: user.id} ),
    };

  }

  checkAuthStatus(user: User) {
    return {
      ...user,
      token: this.getJwtToken({ id: user.id} ),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private handleDBErrors( error: any ): never {
    if (error.code === '23505') 
      throw new BadRequestException(error.detail)

    console.log(error)

    throw new InternalServerErrorException('Please check serve logs')
  }

}
