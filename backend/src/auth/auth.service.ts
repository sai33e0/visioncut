import { Inject, Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, compare } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { PRISMA } from "../prisma/prisma.module";
import { PrismaClient, User } from "@prisma/client";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string; user: PublicUser }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
      },
    });

    return { accessToken: this.sign(user), user: this.toPublic(user) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return { accessToken: this.sign(user), user: this.toPublic(user) };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private sign(user: User): string {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }

  private toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      credits: user.credits,
    };
  }
}

export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  plan: string;
  credits: number;
};
