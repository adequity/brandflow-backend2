import { DataTypes } from 'sequelize';

const WorkTypeModel = (sequelize) => {
  const WorkType = sequelize.define('WorkType', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: '업무 타입명'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '업무 타입 설명'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '활성 여부'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '정렬 순서'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
      comment: '생성자 ID'
    }
  }, {
    timestamps: true,
  });

  return WorkType;
};

export default WorkTypeModel;