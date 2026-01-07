import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    
      private userService: UserService
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'client_secret',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      googleId: id,
    };
    
    
    let existingUser = await this.userService.findUserByEmail(user.email);
    
    if (!existingUser) {
        
        existingUser = await this.userService.createUser({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            googleId: user.googleId,
            avatar: user.picture,
            role: 'CUSTOMER' 
        });
    } else if (!existingUser.googleId) {
        
        await this.userService.updateUser(existingUser.id, {
            googleId: user.googleId,
            avatar: user.picture
        });
    }

    done(null, existingUser);
  }
}
