package config

// Upload says where uploaded files (restaurant pictures) are kept on disk.
type Upload struct {
	Dir string `env:"UPLOAD_DIR" envDefault:"./uploads" validate:"required"`
}

func (upload Upload) Validate() error {
	return validate.Struct(upload)
}
