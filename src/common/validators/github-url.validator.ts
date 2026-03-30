import {
  registerDecorator, ValidationOptions, ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { APP_CONSTANTS } from '../constants/app.constants';

/**
 * WHY: Without URL validation an attacker can pass file:///etc/passwd,
 * http://169.254.169.254 (AWS metadata), or internal network addresses.
 * We whitelist only github.com HTTPS URLs.
 */
@ValidatorConstraint({ async: false })
export class IsGithubUrlConstraint implements ValidatorConstraintInterface {
    validate(url: string): boolean {
        if (!url) return false;

        if (!url.startsWith('https://')) return false;

        try {
            const parsed = new URL(url);

            // Only allow github.com
            if (parsed.hostname !== 'github.com') return false;

            // Block IP literals (extra safety)
            if (/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) return false;

            // Must match owner/repo pattern
            return APP_CONSTANTS.GITHUB_URL_REGEX.test(url.split('?')[0]);
        } catch {
            return false;
        }
    }

  defaultMessage(): string {
    return 'source must be a valid GitHub HTTPS URL (https://github.com/owner/repo)';
  }
}

export function IsGithubUrl(opts?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target:         object.constructor,
      propertyName,
      options:        opts,
      constraints:    [],
      validator:      IsGithubUrlConstraint,
    });
  };
}