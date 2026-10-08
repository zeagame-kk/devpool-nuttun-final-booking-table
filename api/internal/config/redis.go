package config

import "fmt"

type Redis struct {
	Host     string `env:"REDIS_HOST" envDefault:"localhost" validate:"required"`
	Port     int    `env:"REDIS_PORT" envDefault:"6380" validate:"required,min=1,max=65535"`
	Password string `env:"REDIS_PASSWORD"`
	DB       int    `env:"REDIS_DB" envDefault:"0" validate:"gte=0"`
}

func (c Redis) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func (redis Redis) Validate() error {
	return validate.Struct(redis)
}
