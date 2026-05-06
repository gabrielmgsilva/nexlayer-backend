import { PartialType } from '@nestjs/swagger';
import { CreateCostConfigDto } from './create-cost-config.dto';

export class UpdateCostConfigDto extends PartialType(CreateCostConfigDto) {}
