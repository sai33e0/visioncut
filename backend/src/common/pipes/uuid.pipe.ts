import {
  PipeTransform,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { validate } from "uuid";

@Injectable()
export class UuidValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!validate(value)) {
      throw new BadRequestException("Invalid UUID");
    }
    return value;
  }
}
