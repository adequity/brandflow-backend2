// src/models/systemSetting.js
import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const SystemSetting = sequelize.define('SystemSetting', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    
    // 설정 키 (unique)
    settingKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: '설정 키 (예: incentive_visibility, auto_margin_calculation)'
    },
    
    // 설정 값
    settingValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '설정 값 (JSON 문자열 또는 일반 문자열)'
    },
    
    // 설정 타입
    settingType: {
      type: DataTypes.ENUM('boolean', 'string', 'number', 'json'),
      allowNull: false,
      defaultValue: 'string',
      comment: '설정 값의 타입'
    },
    
    // 설정 카테고리
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'general',
      comment: '설정 카테고리 (general, sales, incentive, document 등)'
    },
    
    // 설정 설명
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '설정에 대한 설명'
    },
    
    // 기본값
    defaultValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '기본값'
    },
    
    // 설정이 활성화되어 있는지
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '설정 활성화 여부'
    },
    
    // 수정 권한 (슈퍼 어드민만, 대행사 어드민도 가능 등)
    accessLevel: {
      type: DataTypes.ENUM('super_admin', 'agency_admin', 'staff'),
      allowNull: false,
      defaultValue: 'super_admin',
      comment: '설정 수정 권한 레벨'
    },
    
    // 마지막 수정자
    lastModifiedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '마지막 수정자 ID'
    }
    
  }, {
    tableName: 'system_settings',
    timestamps: true,
    
    indexes: [
      { fields: ['settingKey'], unique: true },
      { fields: ['category'] },
      { fields: ['isActive'] },
      { fields: ['accessLevel'] }
    ]
  });

  return SystemSetting;
}